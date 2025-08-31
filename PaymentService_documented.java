/*
Date: 31/08/2025
User: Agentic_AI_System_Documenter
Code Language: Java
*/

import com.example.paymentgateway.PaymentGatewaySDK;
import com.example.paymentgateway.models.PaymentIntent;
import com.example.paymentgateway.exceptions.PaymentException;

/**
 * The PaymentService class is responsible for handling payment-related operations
 * by interacting with the PaymentGatewaySDK. It provides methods to create and
 * confirm payment intents.
 */
public class PaymentService {

    private final PaymentGatewaySDK sdk;

    /**
     * Constructs a PaymentService instance with the provided secret key.
     *
     * @param secretKey A secret key used for authenticating with the payment gateway.
     */
    public PaymentService(String secretKey) {
        this.sdk = new PaymentGatewaySDK(secretKey);
    }

    /**
     * Creates a payment intent with the specified amount and currency.
     * This method communicates with the payment gateway to initiate a payment process.
     *
     * @param amountInCents The amount to be charged, specified in cents.
     * @param currency The currency code for the payment (e.g., "USD").
     * @return A client secret or unique identifier for the client-side use.
     * @throws PaymentException if there is an error while creating the payment intent.
     */
    public String createPaymentIntent(long amountInCents, String currency) throws PaymentException {
        // Create a payment intent using the SDK
        PaymentIntent intent = sdk.createPaymentIntent(amountInCents, currency);
        return intent.getClientSecret(); // Or a unique ID for client-side use
    }

    /**
     * Confirms a payment given its intent ID.
     * This method finalizes the payment process.
     *
     * @param paymentIntentId The unique identifier for the payment intent to confirm.
     * @return true if the payment is successfully confirmed; false otherwise.
     * @throws PaymentException if there is an error while confirming the payment.
     */
    public boolean confirmPayment(String paymentIntentId) throws PaymentException {
        // Confirm the payment using the SDK
        return sdk.confirmPayment(paymentIntentId);
    }
}