/*
Date: 31/08/2025
User: Agentic_AI_System_Documenter
Code Language: Java
*/

import com.example.paymentgateway.PaymentGatewaySDK;
import com.example.paymentgateway.models.PaymentIntent;
import com.example.paymentgateway.exceptions.PaymentException;

/**
 * This class is responsible for handling payment-related operations using the Payment Gateway SDK.
 */
public class PaymentService {

    private final PaymentGatewaySDK sdk;

    /**
     * Constructs a PaymentService with the specified secret key.
     *
     * @param secretKey The secret key used to initialize the PaymentGatewaySDK.
     */
    public PaymentService(String secretKey) {
        this.sdk = new PaymentGatewaySDK(secretKey);
    }

    /**
     * Creates a payment intent with the specified amount and currency.
     *
     * @param amountInCents The amount to be charged, in cents.
     * @param currency The currency in which the payment is to be made.
     * @return The client secret of the created payment intent, which can be used on the client-side.
     * @throws PaymentException If an error occurs while creating the payment intent.
     */
    public String createPaymentIntent(long amountInCents, String currency) throws PaymentException {
        // Create a PaymentIntent using the SDK
        PaymentIntent intent = sdk.createPaymentIntent(amountInCents, currency);
        // Return the client secret for further processing
        return intent.getClientSecret(); // Or a unique ID for client-side use
    }

    /**
     * Confirms the payment for a given payment intent ID.
     *
     * @param paymentIntentId The ID of the payment intent to confirm.
     * @return true if the payment was successfully confirmed, false otherwise.
     * @throws PaymentException If an error occurs while confirming the payment.
     */
    public boolean confirmPayment(String paymentIntentId) throws PaymentException {
        // Confirm the payment using the SDK
        return sdk.confirmPayment(paymentIntentId);
    }
}