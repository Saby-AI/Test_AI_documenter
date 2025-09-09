/*
Date: 07/09/2025
User: Agentic_AI_System_Documenter
Code Language: Java
*/
/**
 * PaymentService is a class responsible for handling payment operations
 * using the PaymentGatewaySDK. It allows for the creation and confirmation of
 * payment intents for processing transactions.
 */
public class PaymentService {
    // The PaymentGatewaySDK instance used to interact with the payment gateway
    private final PaymentGatewaySDK sdk;
    /**
     * Constructs a PaymentService with the specified secret key for authentication
     * with the payment gateway.
     *
     * @param secretKey The secret key used to initialize the PaymentGatewaySDK.
     */
    public PaymentService(String secretKey) {
        // Initialize the PaymentGatewaySDK with the provided secret key
        this.sdk = new PaymentGatewaySDK(secretKey);
    }
    /**
     * Creates a payment intent for a specified amount and currency.
     *
     * @param amountInCents The amount to be charged in cents (e.g., 1000 for $10.00).
     * @param currency The currency code for the transaction (e.g., "USD").
     * @return The client secret of the created payment intent, which can be used on the client side.
     * @throws PaymentException If there is an issue while creating the payment intent.
     */
    public String createPaymentIntent(long amountInCents, String currency) throws PaymentException {
        // Create a new payment intent using the PaymentGatewaySDK
        PaymentIntent intent = sdk.createPaymentIntent(amountInCents, currency);
        // Return the client secret to be used on the client side
        return intent.getClientSecret(); // Or a unique ID for client-side use
    }
    /**
     * Confirms a payment for a specific payment intent ID.
     *
     * @param paymentIntentId The unique identifier of the payment intent to confirm.
     * @return true if the payment was successfully confirmed, false otherwise.
     * @throws PaymentException If there is an issue while confirming the payment.
     */
    public boolean confirmPayment(String paymentIntentId) throws PaymentException {
        // Confirm the payment using the PaymentGatewaySDK
        return sdk.confirmPayment(paymentIntentId);
    }
}