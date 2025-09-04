/**
 * @brief Creates a payment intent by sending a request to the payment gateway API.
 * 
 * This function initializes a CURL session, sets the necessary options for the HTTP
 * POST request, and sends the request to create a new payment intent. 
 * 
 * @param secret_key A pointer to a null-terminated string containing the secret
 *                   key for authorization with the payment gateway.
 * @param amount_in_cents The amount of money to be charged in cents.
 * @param currency A pointer to a null-terminated string specifying the currency,
 *                 e.g., "usd".
 * 
 * @return Returns 0 on success, -1 on error during the CURL request.
 */
int create_payment_intent_c(const char* secret_key, long amount_in_cents, const char* currency) {
    CURL *curl;  // Pointer for the CURL session
    CURLcode res; // Variable to store the result of the CURL request

    // Initializing CURL
    curl = curl_easy_init();
    
    // Proceed only if curl was initialized successfully
    if (curl) {
        // Setting the URL for the payment gateway's API endpoint
        curl_easy_setopt(curl, CURLOPT_URL, "https://api.paymentgateway.com/v1/payment_intents");
        
        // Prepare the data to be sent in the POST request
        char post_fields[100]; // Buffer for POST fields, ensure it is large enough
        snprintf(post_fields, sizeof(post_fields), "amount=%ld&currency=%s", amount_in_cents, currency); // Dynamically generate the post fields based on parameters
        
        // Set the POST data fields
        curl_easy_setopt(curl, CURLOPT_POSTFIELDS, post_fields);
        
        // Uncomment the line below to add headers for authorization (e.g., Authorization: Bearer <secret_key>)
        // struct curl_slist *headers = NULL;
        // headers = curl_slist_append(headers, "Authorization: Bearer <secret_key>");
        // curl_easy_setopt(curl, CURLOPT_HTTPHEADER, headers);

        // Perform the CURL request
        res = curl_easy_perform(curl);
        
        // Check for errors in the request
        if (res != CURLE_OK) {
            // Print error to stderr if request fails
            fprintf(stderr, "curl_easy_perform() failed: %s\n", curl_easy_strerror(res));
            // Clean up CURL session before returning
            curl_easy_cleanup(curl);
            return -1; // Return -1 to indicate failure
        }

        // Clean up the CURL session if everything is successful
        curl_easy_cleanup(curl);
    }
    return 0; // Return 0 on success
}