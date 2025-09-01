/*
Date: 01/09/2025
User: Agentic_AI_System_Documenter
Code Language: Java
*/

import com.example.paymentgateway.PaymentGatewaySDK;
import com.example.paymentgateway.models.PaymentIntent;
import com.example.paymentgateway.exceptions.PaymentException;

/**
 * PaymentService is responsible for handling payment-related operations such as 
 * creating and confirming payment intents using the PaymentGatewaySDK.
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
     * @param amountInCents The payment amount in cents.
     * @param currency      The currency for the payment intent (e.g., "USD").
     * @return The client secret associated with the created payment intent,
     *         which can be used for client-side operations.
     * @throws PaymentException if there is an error while creating the payment intent.
     */
    public String createPaymentIntent(long amountInCents, String currency) throws PaymentException {
        // Create a new PaymentIntent using the SDK
        PaymentIntent intent = sdk.createPaymentIntent(amountInCents, currency);
        return intent.getClientSecret(); // Or a unique ID for client-side use
    }

    /**
     * Confirms the payment associated with the given payment intent ID.
     *
     * @param paymentIntentId The unique identifier of the payment intent to confirm.
     * @return true if the payment is confirmed successfully; false otherwise.
     * @throws PaymentException if there is an error while confirming the payment.
     */
    public boolean confirmPayment(String paymentIntentId) throws PaymentException {
        // Confirm the payment using the SDK and return the result
        return sdk.confirmPayment(paymentIntentId);
    }
}
