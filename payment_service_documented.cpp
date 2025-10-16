#include <stdio.h>
#include <curl/curl.h>  // Including the libcurl header for handling HTTP requests
// Function to create a payment intent with the given details
int create_payment_intent_c(const char* secret_key, long amount_in_cents, const char* currency) {
    CURL *curl;  // Pointer for CURL
    CURLcode res;  // Variable to store the result of curl operations
    curl = curl_easy_init();  // Initialize a CURL session
    if (curl) {
        // Set the URL for the API endpoint for creating payment intents
        curl_easy_setopt(curl, CURLOPT_URL, "https://api.paymentgateway.com/v1/payment_intents");
        // Set POST fields for the request; currently hardcoded data (should be dynamic)
        curl_easy_setopt(curl, CURLOPT_POSTFIELDS, "amount=1000&currency=usd");
        // Optional: Add authorization header (implementation not shown)
        // curl_easy_setopt(curl, CURLOPT_HTTPHEADER, headers);
        // Perform the request and capture the result
        res = curl_easy_perform(curl);
        if (res != CURLE_OK) {
            // Output error if the request fails
            fprintf(stderr, "curl_easy_perform() failed: %s
", curl_easy_strerror(res));
            return -1;  // Indicate failure
        }
        curl_easy_cleanup(curl);  // Clean up CURL session
    }
    return 0;  // Indicate success
}