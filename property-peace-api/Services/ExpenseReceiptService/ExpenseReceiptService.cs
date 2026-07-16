using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Models;
using brownstone_hub_api.Dtos.ExpenseReceipt;
using brownstone_hub_api.Repositories.ExpenseReceipts;
using brownstone_hub_api.Services.AzureBlobService;

namespace brownstone_hub_api.Services.ExpenseReceiptService
{
    public class ExpenseReceiptService(
        BlobServiceClient blobServiceClient,
        IAzureBlobService azureBlobService,
        IExpenseReceiptRepository expenseReceiptRepository,
        IConfiguration configuration,
        ILogger<ExpenseReceiptService> logger) : IExpenseReceiptService
    {
        private readonly BlobServiceClient _blobServiceClient = blobServiceClient;
        private readonly IAzureBlobService _azureBlobService = azureBlobService;
        private readonly IExpenseReceiptRepository _expenseReceiptRepository = expenseReceiptRepository;
        private readonly IConfiguration _configuration = configuration;
        private readonly ILogger<ExpenseReceiptService> _logger = logger;

        public async Task<ServiceResponse<List<LoadExpenseReceiptDto>>> AddExpenseReceipts(long expenseId, List<IFormFile> files)
        {
            try
            {
                var response = new ServiceResponse<List<LoadExpenseReceiptDto>>
                {
                    Data = []
                };

                var sasUri = string.Empty;
                var containerClient = _blobServiceClient.GetBlobContainerClient("expense-receipts");

                await containerClient.CreateIfNotExistsAsync(PublicAccessType.None);

                foreach (var receipt in files)
                {
                    // Create a unique blob name
                    var blobName = $"{Guid.NewGuid()}{Path.GetExtension(receipt.FileName)}";
                    var blobClient = containerClient.GetBlobClient(blobName);

                    // Upload the file
                    using (var stream = receipt.OpenReadStream())
                    {
                        await blobClient.UploadAsync(stream, new BlobHttpHeaders { ContentType = receipt.ContentType });
                    }

                    var expenseReceipt = new AddExpenseReceiptDto
                    {
                        ExpenseId = expenseId,
                        BlobName = blobName,
                        BlobUrl = blobClient.Uri.ToString()
                    };

                    // Save the receipt details to the database
                    var result = await _expenseReceiptRepository.AddExpenseReceipt(expenseReceipt);

                    // Generate a read-only SAS URI valid for 1 hour
                    sasUri = _azureBlobService.GenerateBlobSasUri(_blobServiceClient, blobClient, TimeSpan.FromHours(1));
                    result.BlobUrl = sasUri;
                    response.Data.Add(result);
                }

                response.Message = "Expense receipts uploaded successfully";
                return response;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error uploading expense receipt to Azure Blob Storage");
                return ServiceResponse<List<LoadExpenseReceiptDto>>.CreateError("Error uploading receipt", ex.Message, ex.InnerException?.Message);
            }
        }

        public async Task<ServiceResponse<List<LoadExpenseReceiptDto>>> GetExpenseReceipts(long expenseId)
        {
            try
            {
                var response = new ServiceResponse<List<LoadExpenseReceiptDto>>
                {
                    Data = []
                };

                // Get receipts from the database
                var receipts = await _expenseReceiptRepository.GetExpenseReceiptsByExpenseId(expenseId);
                if (receipts == null || receipts.Count == 0)
                {
                    response.Message = "No receipts found for this expense";
                    return response;
                }

                // Generate SAS URLs for each receipt
                foreach (var receipt in receipts)
                {
                    var blobClient = _blobServiceClient.GetBlobContainerClient("expense-receipts").GetBlobClient(receipt.BlobName);
                    var sasUri = _azureBlobService.GenerateBlobSasUri(_blobServiceClient, blobClient, TimeSpan.FromHours(1));
                    receipt.BlobUrl = sasUri;
                    response.Data.Add(receipt);
                }

                response.Message = "Expense receipts retrieved successfully";
                return response;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving expense receipts");
                return ServiceResponse<List<LoadExpenseReceiptDto>>.CreateError("Error retrieving receipts", ex.Message, ex.InnerException?.Message);
            }
        }

        public async Task<ServiceResponse<LoadExpenseReceiptDto>> DeleteExpenseReceipt(long id)
        {
            try
            {
                var response = new ServiceResponse<LoadExpenseReceiptDto>();

                // Delete the receipt from the database
                var deletedReceipt = await _expenseReceiptRepository.DeleteExpenseReceipt(id);
                if (deletedReceipt == null)
                {
                    response.Message = "Receipt not found";
                    return response;
                }

                // Delete the receipt from Azure Blob Storage
                var blobClient = _blobServiceClient.GetBlobContainerClient("expense-receipts").GetBlobClient(deletedReceipt.BlobName);
                await blobClient.DeleteIfExistsAsync();

                response.Data = deletedReceipt;
                response.Message = "Expense receipt deleted successfully";
                return response;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting expense receipt");
                return ServiceResponse<LoadExpenseReceiptDto>.CreateError("Error deleting receipt", ex.Message, ex.InnerException?.Message);
            }
        }
    }
}

