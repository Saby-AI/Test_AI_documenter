/*
Date: 31/08/2025
User: Agentic_AI_System_Documenter
Code Language: Java
*/

import com.example.paymentgateway.PaymentGatewaySDK;
import com.example.paymentgateway.models.PaymentIntent;
import com.example.paymentgateway.exceptions.PaymentException;

/**
 * The PaymentService class facilitates payment processing using the PaymentGatewaySDK.
 * It handles the creation and confirmation of payment intents.
 */
public class PaymentService {

    private final PaymentGatewaySDK sdk;

    /**
     * Constructs a PaymentService with a specified secret key.
     *
     * @param secretKey the secret key used to initialize the PaymentGatewaySDK
     */
    public PaymentService(String secretKey) {
        this.sdk = new PaymentGatewaySDK(secretKey);
    }

    /**
     * Creates a payment intent for a specified amount and currency.
     *
     * @param amountInCents the amount to be charged, in cents
     * @param currency      the currency code (e.g., "USD")
     * @return the client secret of the payment intent, used for client-side operations
     * @throws PaymentException if there is an error creating the payment intent
     */
    public String createPaymentIntent(long amountInCents, String currency) throws PaymentException {
        // Create a payment intent through the SDK
        PaymentIntent intent = sdk.createPaymentIntent(amountInCents, currency);
        return intent.getClientSecret(); // Or a unique ID for client-side use
    }

    /**
     * Confirms a payment using its intent ID.
     *
     * @param paymentIntentId the ID of the payment intent to confirm
     * @return true if the payment was confirmed successfully, false otherwise
     * @throws PaymentException if there is an error confirming the payment
     */
    public boolean confirmPayment(String paymentIntentId) throws PaymentException {
        // Confirm the payment through the SDK
        return sdk.confirmPayment(paymentIntentId);
    }
}