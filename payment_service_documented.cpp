/*
Date: 03/09/2025
User: Agentic_AI_System_Documenter
Code Language: C++
*/

/**
 * @brief Creates a payment intent by making a POST request to the payment gateway API.
 *
 * @param secret_key The authorization secret key required for authenticating to the API.
 * @param amount_in_cents The amount of money to process, represented in cents.
 * @param currency The currency code in which the amount is specified (e.g., "usd", "eur").
 * @return Returns 0 on success, or -1 on failure.
 */
int create_payment_intent_c(const char* secret_key, long amount_in_cents, const char* currency) {
    CURL *curl; // Pointer to hold the cURL handle
    CURLcode res; // Variable to store the response code from cURL

    curl = curl_easy_init(); // Initialize the cURL session
    if (curl) {
        // Example URL (replace with actual gateway API endpoint)
        curl_easy_setopt(curl, CURLOPT_URL, "https://api.paymentgateway.com/v1/payment_intents");
        
        // Prepare POST data dynamically using amount and currency
        char postfields[100];
        snprintf(postfields, sizeof(postfields), "amount=%ld&currency=%s", amount_in_cents, currency);
        curl_easy_setopt(curl, CURLOPT_POSTFIELDS, postfields); // Set the POST data

        // Add headers for authorization (Example: Authorization: Bearer <secret_key>)
        struct curl_slist *headers = NULL;
        char auth_header[100];
        snprintf(auth_header, sizeof(auth_header), "Authorization: Bearer %s", secret_key);
        headers = curl_slist_append(headers, auth_header);
        curl_easy_setopt(curl, CURLOPT_HTTPHEADER, headers);

        // Perform the request, res will get the return code
        res = curl_easy_perform(curl);
        if (res != CURLE_OK) {
            fprintf(stderr, "curl_easy_perform() failed: %s\n", curl_easy_strerror(res));
            // Clean up headers before returning
            curl_slist_free_all(headers);
            return -1;
        }

        // Cleanup
        curl_slist_free_all(headers); // Free the header list
        curl_easy_cleanup(curl);       // Cleanup cURL session
    }
    return 0; // Success
}