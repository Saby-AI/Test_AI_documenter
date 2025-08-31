/*
Date: 31/08/2025
User: Agentic_AI_System_Documenter
Code Language: Java
*/

import com.example.paymentgateway.PaymentGatewaySDK;
import com.example.paymentgateway.models.PaymentIntent;
import com.example.paymentgateway.exceptions.PaymentException;

/**
 * PaymentService is responsible for handling payment intents and confirming payments
 * using the PaymentGatewaySDK.
 */
public class PaymentService {

    private final PaymentGatewaySDK sdk;

    /**
     * Constructs a PaymentService with the specified secret key.
     *
     * @param secretKey the secret key for the payment gateway SDK
     */
    public PaymentService(String secretKey) {
        this.sdk = new PaymentGatewaySDK(secretKey);
    }

    /**
     * Creates a payment intent with the specified amount and currency.
     *
     * @param amountInCents the amount in cents to be charged
     * @param currency the currency of the payment (e.g., "USD")
     * @return the client secret of the created payment intent for client-side use
     * @throws PaymentException if there is an error while creating the payment intent
     */
    public String createPaymentIntent(long amountInCents, String currency) throws PaymentException {
        // Create a new payment intent using the SDK
        PaymentIntent intent = sdk.createPaymentIntent(amountInCents, currency);
        // Return the client secret for the payment intent
        return intent.getClientSecret(); // Or a unique ID for client-side use
    }

    /**
     * Confirms a payment using the specified payment intent ID.
     *
     * @param paymentIntentId the ID of the payment intent to confirm
     * @return true if the payment was successfully confirmed, false otherwise
     * @throws PaymentException if there is an error while confirming the payment
     */
    public boolean confirmPayment(String paymentIntentId) throws PaymentException {
        // Confirm the payment through the SDK
        return sdk.confirmPayment(paymentIntentId);
    }
}