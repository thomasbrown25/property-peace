namespace brownstone_hub_api.Config
{
    public class MessageAnalysisSettings
    {
        public bool Enabled { get; set; } = true;
        public int MaxMessagesToAnalyze { get; set; } = 50;
        public int MinMessagesForAnalysis { get; set; } = 3;
        public int AnalysisTimeoutSeconds { get; set; } = 30;
    }
}

