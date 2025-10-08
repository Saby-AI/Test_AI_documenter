```cpp
/*
Date: 08/10/2025
User: Agentic_AI_System_Documenter
Code Language: C++
*/
/**
 * @brief Creates a payment intent with the specified parameters.
 *
 * This function initiates an HTTP POST request to the payment gateway
 * API to create a payment intent. It uses the provided secret key,
 * amount in cents, and currency to configure the request.
 *
 * @param secret_key A string that represents the secret key for authentication.
 * @param amount_in_cents The amount to charge in cents.
 * @param currency A string representing the currency (e.g., "usd").
 * @return Returns 0 on success, or -1 on failure.
 */
int create_payment_intent_c(const char* secret_key, long amount_in_cents, const char* currency) {
    CURL *curl;  // Initialization of CURL handle
    CURLcode res;  // Variable to hold the result of the cURL operation
    curl = curl_easy_init();  // Initialize cURL
    if (curl) {
        // Endpoint for creating payment intents; this should be made configurable.
        curl_easy_setopt(curl, CURLOPT_URL, "https://api.paymentgateway.com/v1/payment_intents");
        // Configuration of the POST data; this should dynamically include parameters.
        // Consider using more sophisticated data structures or JSON libraries for production.
        char post_data[100];
        snprintf(post_data, sizeof(post_data), "amount=%ld&currency=%s", amount_in_cents, currency);
        curl_easy_setopt(curl, CURLOPT_POSTFIELDS, post_data);
        // TODO: Set appropriate headers for Authorization and Content-Type.
        // Example: curl_slist* headers = NULL;
        // headers = curl_slist_append(headers, "Authorization: Bearer <secret_key>");
        // curl_easy_setopt(curl, CURLOPT_HTTPHEADER, headers);
        // Perform the request, res will contain the return code
        res = curl_easy_perform(curl);
        if (res != CURLE_OK) {
            // Provide error messages for debugging; consider logging for production systems.
            fprintf(stderr, "curl_easy_perform() failed: %s
", curl_easy_strerror(res));
            return -1;  // Return an error code in case the call fails
        }
        curl_easy_cleanup(curl);  // Cleanup cURL resources
    }
    return 0;  // Successfully initiated a payment intent
}
```