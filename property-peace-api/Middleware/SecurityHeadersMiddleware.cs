namespace brownstone_hub_api.Middleware
{
    /// <summary>
    /// Middleware to add security headers to all HTTP responses
    /// </summary>
    public class SecurityHeadersMiddleware
    {
        private readonly RequestDelegate _next;
        private readonly ILogger<SecurityHeadersMiddleware> _logger;

        public SecurityHeadersMiddleware(RequestDelegate next, ILogger<SecurityHeadersMiddleware> logger)
        {
            _next = next;
            _logger = logger;
        }

        public async Task InvokeAsync(HttpContext context)
        {
            // Add security headers
            context.Response.Headers.Append("X-Content-Type-Options", "nosniff");
            context.Response.Headers.Append("X-Frame-Options", "DENY");
            context.Response.Headers.Append("X-XSS-Protection", "1; mode=block");
            context.Response.Headers.Append("Referrer-Policy", "strict-origin-when-cross-origin");
            
            // Content Security Policy - adjust based on your needs
            // This is a restrictive policy - you may need to adjust for your frontend
            var csp = "default-src 'self'; " +
                      "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " + // unsafe-inline/unsafe-eval may be needed for some frameworks
                      "style-src 'self' 'unsafe-inline'; " +
                      "img-src 'self' data: https:; " +
                      "font-src 'self' data:; " +
                      "connect-src 'self' https://api.stripe.com https://*.stripe.com; " + // Allow Stripe API
                      "frame-src 'self' blob: https://js.stripe.com https://hooks.stripe.com https://*.docusign.net https://demo.docusign.net https://account-d.docusign.com https://*.docusign.com; " + // Allow Stripe, DocuSign iframes, and blob for PDF preview
                      "object-src 'none'; " +
                      "base-uri 'self'; " +
                      "form-action 'self'; " +
                      "frame-ancestors 'none'; " +
                      "upgrade-insecure-requests;";
            
            context.Response.Headers.Append("Content-Security-Policy", csp);
            
            // Strict Transport Security (HSTS) - only add in production with HTTPS
            if (context.Request.IsHttps)
            {
                context.Response.Headers.Append("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
            }

            // Permissions Policy (formerly Feature Policy)
            context.Response.Headers.Append("Permissions-Policy", 
                "geolocation=(), " +
                "microphone=(), " +
                "camera=(), " +
                "payment=(), " +
                "usb=(), " +
                "magnetometer=(), " +
                "gyroscope=(), " +
                "accelerometer=()");

            await _next(context);
        }
    }

    /// <summary>
    /// Extension method to register the middleware
    /// </summary>
    public static class SecurityHeadersMiddlewareExtensions
    {
        public static IApplicationBuilder UseSecurityHeaders(this IApplicationBuilder builder)
        {
            return builder.UseMiddleware<SecurityHeadersMiddleware>();
        }
    }
}

