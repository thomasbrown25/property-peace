

namespace brownstone_hub_api.Models
{
    public static class ServiceResponseSettings
    {
        public static bool ShowDetailedErrors { get; set; } = true;
    }

    public class ServiceResponse<T>
    {
        public bool Success { get; set; } = true;
        public string Message { get; set; } = "Request was successful";
        public T? Data { get; set; }
        public int StatusCode { get; set; } = 200;
        public Error Errors { get; set; } = new Error();

        public static ServiceResponse<T> CreateError(
            string errorMessage,
            string errorDetails = "",
            string? innerException = "",
            int statusCode = 400,
            bool suppressDetailedErrors = false)
        {
            var showDetailedErrors = ServiceResponseSettings.ShowDetailedErrors && !suppressDetailedErrors;

            return new ServiceResponse<T>
            {
                Success = false,
                Message = errorMessage,
                StatusCode = statusCode,
                Errors = new Error
                {
                    Message = showDetailedErrors ? errorMessage : null,
                    Details = showDetailedErrors ? errorDetails : null,
                    InnerException = showDetailedErrors ? innerException : null
                }
            };
        }

        public static ServiceResponse<T> CreateSuccess(T data, string successMessage = "Request was successful", int statusCode = 200)
        {
            return new ServiceResponse<T>
            {
                Success = true,
                Message = successMessage,
                Data = data,
                StatusCode = statusCode
            };
        }

    }

    public class Error
    {
        public string? Message { get; set; }
        public string? Details { get; set; }
        public string? InnerException { get; set; }
    }
}
