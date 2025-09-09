/*
Date: 07/09/2025
User: Agentic_AI_System_Documenter
Code Language: Java
*/
/**
 * The PaymentService class interacts with the PaymentGatewaySDK to facilitate payment operations.
 * It provides methods to create and confirm payment intents.
 * This service is designed following the principles of a clean architecture, ensuring separation
 * of concerns, and a focus on payment processing responsiveness and reliability.
 */
public class PaymentService {
    // PaymentGatewaySDK instance for interacting with the payment provider.
    private final PaymentGatewaySDK sdk;
    /**
     * Constructor to initialize the PaymentService with a secret key.
     *
     * @param secretKey The secret key used for authenticating with the payment gateway.
     */
    public PaymentService(String secretKey) {
        this.sdk = new PaymentGatewaySDK(secretKey);
    }
    /**
     * Creates a payment intent for the specified amount and currency.
     * <p>
     * This method interacts with the PaymentGatewaySDK to initiate a payment.
     *
     * @param amountInCents The amount to charge in cents (e.g., 100 for $1.00).
     * @param currency The currency code (e.g., USD, EUR).
     * @return String Returns the client secret associated with the payment intent.
     * @throws PaymentException If there is an error creating the payment intent.
     */
    public String createPaymentIntent(long amountInCents, String currency) throws PaymentException {
        // Create a payment intent via the SDK
        PaymentIntent intent = sdk.createPaymentIntent(amountInCents, currency);
        return intent.getClientSecret(); // Return the client secret for client-side usage
    }
    /**
     * Confirms the payment using the provided payment intent ID.
     * <p>
     * This method finalizes the payment process.
     *
     * @param paymentIntentId The ID of the payment intent to confirm.
     * @return boolean Returns true if the payment was confirmed successfully, false otherwise.
     * @throws PaymentException If there is an error confirming the payment.
     */
    public boolean confirmPayment(String paymentIntentId) throws PaymentException {
        // Confirm the payment and return the result
        return sdk.confirmPayment(paymentIntentId);
    }
}