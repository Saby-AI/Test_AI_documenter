/*
Date: 02/09/2025
User: Agentic_AI_System_Documenter
Code Language: C++
*/

/**
 * @brief Creates a payment intent using the specified secret key, amount, and currency.
 *
 * This function initializes a CURL session to send a POST request to the payment 
 * gateway's API to create a payment intent with the given parameters.
 *
 * @param secret_key A string containing the secret key for authentication with the payment gateway.
 * @param amount_in_cents A long integer representing the amount in cents to be charged.
 * @param currency A string representing the currency code (e.g., 'usd', 'eur') for the transaction.
 *
 * @return Returns 0 on success, or -1 on failure if the CURL operation fails.
 */
int create_payment_intent_c(const char* secret_key, long amount_in_cents, const char* currency) {
    CURL *curl;  // Pointer to a CURL handle
    CURLcode res;  // Variable to hold the CURL operation result

    curl = curl_easy_init();  // Initialize CURL
    if (curl) {
        curl_easy_setopt(curl, CURLOPT_URL, 'https://api.paymentgateway.com/v1/payment_intents');
        
        char post_fields[100];  // Buffer to store POST parameters
        snprintf(post_fields, sizeof(post_fields), 'amount=%ld&currency=%s', amount_in_cents, currency);
        curl_easy_setopt(curl, CURLOPT_POSTFIELDS, post_fields);  // Set POST fields

        res = curl_easy_perform(curl);  // Perform the CURL operation
        if (res != CURLE_OK) {
            // If the operation fails, print an error message to stderr
            fprintf(stderr, 'curl_easy_perform() failed: %s\n', curl_easy_strerror(res));
            return -1;  // Return -1 on failure
        }
        curl_easy_cleanup(curl);  // Cleanup CURL resources
    }
    return 0;  // Return 0 on success
}
