/*
Date: 31/08/2025
User: Agentic_AI_System_Documenter
Code Language: Java
*/

import com.example.paymentgateway.PaymentGatewaySDK;
import com.example.paymentgateway.models.PaymentIntent;
import com.example.paymentgateway.exceptions.PaymentException;

/**
 * The PaymentService class is responsible for handling payment-related operations,
 * including creating and confirming payment intents using the PaymentGatewaySDK.
 */
public class PaymentService {

    private final PaymentGatewaySDK sdk;

    /**
     * Constructs a PaymentService instance with the specified secret key.
     *
     * @param secretKey The secret key for authenticating with the payment gateway.
     */
    public PaymentService(String secretKey) {
        this.sdk = new PaymentGatewaySDK(secretKey);
    }

    /**
     * Creates a payment intent for a specified amount and currency.
     *
     * @param amountInCents The amount to charge in cents.
     * @param currency The currency code (e.g., "USD", "EUR").
     * @return A client secret or a unique ID for client-side use.
     * @throws PaymentException If an error occurs while creating the payment intent.
     */
    public String createPaymentIntent(long amountInCents, String currency) throws PaymentException {
        // Create a PaymentIntent using the SDK
        PaymentIntent intent = sdk.createPaymentIntent(amountInCents, currency);
        return intent.getClientSecret(); // Return the client secret for further processing
    }

    /**
     * Confirms a payment using the specified payment intent ID.
     *
     * @param paymentIntentId The ID of the payment intent to confirm.
     * @return True if the payment was confirmed successfully; otherwise, false.
     * @throws PaymentException If an error occurs while confirming the payment.
     */
    public boolean confirmPayment(String paymentIntentId) throws PaymentException {
        // Confirm the payment through the SDK
        return sdk.confirmPayment(paymentIntentId);
    }
}