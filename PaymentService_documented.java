/*
Date: 03/09/2025
User: Agentic_AI_System_Documenter
Code Language: Java
*/

/**
 * PaymentService class provides an interface for creating and confirming payment intents 
 * using the PaymentGatewaySDK.
 */
public class PaymentService {

    private final PaymentGatewaySDK sdk; // SDK for interacting with the payment gateway

    /**
     * Constructs a new PaymentService with the provided secret key.
     *
     * @param secretKey the secret key required for initializing the PaymentGatewaySDK
     */
    public PaymentService(String secretKey) {
        this.sdk = new PaymentGatewaySDK(secretKey);
    }

    /**
     * Creates a payment intent for a specified amount and currency.
     *
     * @param amountInCents the amount of money to be charged, in cents
     * @param currency the currency of the payment
     * @return the client secret or a unique ID for client-side use
     * @throws PaymentException if there is an error creating the payment intent
     */
    public String createPaymentIntent(long amountInCents, String currency) throws PaymentException {
        PaymentIntent intent = sdk.createPaymentIntent(amountInCents, currency);
        return intent.getClientSecret(); // Return client secret for frontend integration
    }

    /**
     * Confirms a payment using the payment intent ID.
     *
     * @param paymentIntentId the ID of the payment intent to confirm
     * @return true if payment was confirmed successfully; false otherwise
     * @throws PaymentException if there is an error confirming the payment
     */
    public boolean confirmPayment(String paymentIntentId) throws PaymentException {
        return sdk.confirmPayment(paymentIntentId);
    }
}
