/*
Date: 31/08/2025
User: Agentic_AI_System_Documenter
Code Language: Java
*/

import com.example.paymentgateway.PaymentGatewaySDK;
import com.example.paymentgateway.models.PaymentIntent;
import com.example.paymentgateway.exceptions.PaymentException;

public class PaymentService {

    private final PaymentGatewaySDK sdk;

    /**
     * Constructor for PaymentService.
     * Initializes the PaymentGatewaySDK with the provided secret key.
     *
     * @param secretKey the secret key for the payment gateway SDK.
     */
    public PaymentService(String secretKey) {
        this.sdk = new PaymentGatewaySDK(secretKey);
    }

    /**
     * Creates a payment intent with the specified amount and currency.
     * 
     * @param amountInCents the amount for the payment in cents.
     * @param currency the currency in which the payment is to be made (e.g., "USD").
     * @return the client secret for the created payment intent, used for client-side processing.
     * @throws PaymentException if the payment intent creation fails.
     */
    public String createPaymentIntent(long amountInCents, String currency) throws PaymentException {
        // Create a new payment intent using the SDK
        PaymentIntent intent = sdk.createPaymentIntent(amountInCents, currency);
        return intent.getClientSecret(); // Or a unique ID for client-side use
    }

    /**
     * Confirms a payment using the given payment intent ID.
     * 
     * @param paymentIntentId the ID of the payment intent to confirm.
     * @return true if the payment was confirmed successfully, false otherwise.
     * @throws PaymentException if the payment confirmation fails.
     */
    public boolean confirmPayment(String paymentIntentId) throws PaymentException {
        // Confirm the payment with the SDK
        return sdk.confirmPayment(paymentIntentId);
    }
}
