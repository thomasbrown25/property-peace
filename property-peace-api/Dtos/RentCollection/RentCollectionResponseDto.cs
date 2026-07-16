using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace brownstone_hub_api.Dtos.RentCollection
{
    public class RentCollectionResponseDto
    {
        public RentCollectionSummaryDto Summary { get; set; }
        public List<RentRecordDto> RentRecords { get; set; }
    }
}