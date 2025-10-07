```cpp
/*
Date: 07/10/2025
User: Agentic_AI_System_Documenter
Code Language: C++
*/
/**
 * @brief Creates a payment intent with the specified payment gateway.
 *
 * This function initializes a cURL session to make an HTTP POST request
 * to a payment gateway API for creating a payment intent. The function
 * requires the secret key used to authorize the request, the amount in
 * cents, and the currency type.
 *
 * @param secret_key The secret key required for API authorization.
 * @param amount_in_cents The amount for the payment in cents.
 * @param currency The currency code (e.g., "usd", "eur").
 *
 * @return 0 on success, -1 on failure.
 *
 * @note In a production system, additional error handling, input validation,
 * and logging should be implemented to ensure reliability and security.
 */
int create_payment_intent_c(const char* secret_key, long amount_in_cents, const char* currency) {
    CURL *curl;
    CURLcode res;
    // Initialize a cURL session
    curl = curl_easy_init();
    if (curl) {
        // Example API URL for payment gateway
        curl_easy_setopt(curl, CURLOPT_URL, "https://api.paymentgateway.com/v1/payment_intents");
        // Prepare POST data with parameters
        // NOTE: The amount and currency need to be correctly formatted and secured
        char postfields[100];
        snprintf(postfields, sizeof(postfields), "amount=%ld&currency=%s", amount_in_cents, currency);
        // Set the POST fields for the request
        curl_easy_setopt(curl, CURLOPT_POSTFIELDS, postfields);
        // For authorization, headers would be set (not implemented)
        // Example: curl_easy_setopt(curl, CURLOPT_HTTPHEADER, headers);
        // Perform the request, res will contain the result of the operation
        res = curl_easy_perform(curl);
        if (res != CURLE_OK) {
            fprintf(stderr, "curl_easy_perform() failed: %s
", curl_easy_strerror(res));
            return -1; // indicate error
        }
        // Cleanup cURL session
        curl_easy_cleanup(curl);
    }
    return 0; // successful completion
}
```
This documented code expands on the functionality to include description, purpose, and usage of the function, serving well for review and future modification by any team member.