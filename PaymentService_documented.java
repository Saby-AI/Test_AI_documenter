/*
Date: 02/09/2025
User: Agentic_AI_System_Documenter
Code Language: Java
*/

import com.example.paymentgateway.PaymentGatewaySDK;
import com.example.paymentgateway.models.PaymentIntent;
import com.example.paymentgateway.exceptions.PaymentException;

/**
 * Service class to handle payment processing operations.
 */
public class PaymentService {

    // Instance of the PaymentGatewaySDK to interact with the payment gateway API.
    private final PaymentGatewaySDK sdk;

    /**
     * Constructor to initialize the PaymentService with a secret key.
     *
     * @param secretKey the secret key used for authenticating with the payment gateway.
     */
    public PaymentService(String secretKey) {
        this.sdk = new PaymentGatewaySDK(secretKey);
    }

    /**
     * Creates a payment intent for a specified amount and currency.
     *
     * @param amountInCents the amount in cents to be charged.
     * @param currency the currency code in which the payment will be made (e.g., "USD", "EUR").
     * @return the client secret to be used on the client-side to confirm the payment.
     * @throws PaymentException if there is an error while creating the payment intent.
     */
    public String createPaymentIntent(long amountInCents, String currency) throws PaymentException {
        // Create a new payment intent using the SDK.
        PaymentIntent intent = sdk.createPaymentIntent(amountInCents, currency);
        // Return the client secret for client-side operations.
        return intent.getClientSecret(); // Or a unique ID for client-side use
    }

    /**
     * Confirms a payment using the specified payment intent ID.
     *
     * @param paymentIntentId the ID of the payment intent to confirm.
     * @return true if the payment was confirmed successfully; false otherwise.
     * @throws PaymentException if there is an error while confirming the payment.
     */
    public boolean confirmPayment(String paymentIntentId) throws PaymentException {
        // Confirm the payment using the SDK and return the success status.
        return sdk.confirmPayment(paymentIntentId);
    }
}