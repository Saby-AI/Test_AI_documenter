/*
Date: 01/09/2025
User: Agentic_AI_System_Documenter
Code Language: C++
*/

#include <stdio.h>
#include <curl/curl.h>

/**
 * Creates a payment intent by sending a request to a payment gateway API.
 *
 * @param secret_key The secret key for authenticating with the payment gateway.
 * @param amount_in_cents The amount for the payment represented in cents.
 * @param currency The currency code (e.g., "usd") for the payment.
 * @return 0 on success, -1 on failure while performing the CURL request.
 */
int create_payment_intent_c(const char* secret_key, long amount_in_cents, const char* currency) {
    CURL *curl;          // Pointer to CURL structure
    CURLcode res;       // CURL return code

    curl = curl_easy_init();  // Initialize a CURL session
    if (curl) {
        // Example URL (replace with actual gateway API endpoint)
        curl_easy_setopt(curl, CURLOPT_URL, "https://api.paymentgateway.com/v1/payment_intents");
        
        // Prepare post fields with provided amount and currency
        char postfields[256];  // Buffer to hold post data
        snprintf(postfields, sizeof(postfields), "amount=%ld&currency=%s", amount_in_cents, currency);
        curl_easy_setopt(curl, CURLOPT_POSTFIELDS, postfields); // Set the POST data
        
        // Add headers for authorization (e.g., Authorization: Bearer <secret_key>)
        // Uncomment and set appropriate headers if necessary:
        // struct curl_slist *headers = NULL;
        // headers = curl_slist_append(headers, "Authorization: Bearer <secret_key>");
        // curl_easy_setopt(curl, CURLOPT_HTTPHEADER, headers);

        res = curl_easy_perform(curl);  // Perform the CURL request
        if (res != CURLE_OK) {
            fprintf(stderr, "curl_easy_perform() failed: %s\n", curl_easy_strerror(res));
            return -1;  // Return -1 on CURL request failure
        }
        
        curl_easy_cleanup(curl);  // Clean up the CURL session
    }
    return 0;  // Return 0 on successful execution
}
