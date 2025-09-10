/*
Date: 07/09/2025
User: Agentic_AI_System_Documenter
Code Language: C
*/
/**
 * @brief Creates a payment intent by sending a request to the payment gateway API.
 *
 * This function initializes a CURL session and setups an HTTP POST request
 * to create a payment intent for specified amount and currency.
 *
 * @param secret_key The secret key for authenticating with the payment gateway API.
 * @param amount_in_cents The amount to be charged in cents.
 * @param currency The currency of the transaction (e.g., "usd").
 * @return int Returns 0 on success, -1 on failure.
 */
int create_payment_intent_c(const char* secret_key, long amount_in_cents, const char* currency) {
    CURL *curl;         // CURL handle for the session
    CURLcode res;       // Variable to hold the result of the curl operation
    char postfields[1024];  // Buffer for post fields
    // Initialize CURL session
    curl = curl_easy_init();
    if (curl) {
        // Compose the POST fields string in the expected format
        snprintf(postfields, sizeof(postfields), "amount=%ld&currency=%s", amount_in_cents, currency);
        // Set the URL of the payment intent endpoint
        curl_easy_setopt(curl, CURLOPT_URL, "https://api.paymentgateway.com/v1/payment_intents");
        // Set the POST fields for the request
        curl_easy_setopt(curl, CURLOPT_POSTFIELDS, postfields);
        // Example: Set the authorization header (uncomment and add actual auth method)
        // struct curl_slist *headers = NULL;
        // headers = curl_slist_append(headers, "Authorization: Bearer <secret_key>");
        // curl_easy_setopt(curl, CURLOPT_HTTPHEADER, headers);
        // Perform the request and check for errors
        res = curl_easy_perform(curl);
        if (res != CURLE_OK) {
            // Output error message to standard error
            fprintf(stderr, "curl_easy_perform() failed: %s
", curl_easy_strerror(res));
            curl_easy_cleanup(curl);  // Cleanup CURL resources before returning
            return -1;                // Indicate failure
        }
        // Cleanup the CURL session
        curl_easy_cleanup(curl);
    }
    // Success
    return 0;
}
```
This documentation follows the coding standard and provides clear insights into the function's purpose, parameters, return type, and error feedback mechanisms. Upgrade this code with proper security measures, structured handling, and dependency management for a robust implementation.