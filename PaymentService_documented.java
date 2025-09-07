/*
Date: 07/09/2025
User: Agentic_AI_System_Documenter
Code Language: Java
*/
/**
 * PaymentService class serves as an interface to the PaymentGatewaySDK for facilitating payment transactions.
 * It handles the creation of payment intents and confirmation of payments.
 *
 * Key Methods:
 * - createPaymentIntent: Initiates a new payment intent.
 * - confirmPayment: Confirms the payment based on a payment intent ID.
 */
public class PaymentService {
    private final PaymentGatewaySDK sdk; // The SDK instance for interacting with the payment gateway.
    /**
     * Constructs a PaymentService instance with the specified secret key for authentication.
     *
     * @param secretKey The secret key used for authenticating requests with the payment gateway.
     */
    public PaymentService(String secretKey) {
        this.sdk = new PaymentGatewaySDK(secretKey);
    }
    /**
     * Creates a payment intent with the specified amount and currency.
     *
     * @param amountInCents The amount to charge in cents.
     * @param currency The currency in which to process the payment (e.g., "USD").
     * @return The client secret associated with the payment intent.
     * @throws PaymentException If an error occurs while creating the payment intent.
     */
    public String createPaymentIntent(long amountInCents, String currency) throws PaymentException {
        PaymentIntent intent = sdk.createPaymentIntent(amountInCents, currency); // Create the payment intent via the SDK.
        return intent.getClientSecret(); // Return the client secret for further processing on the client side.
    }
    /**
     * Confirms the payment using the provided payment intent ID.
     *
     * @param paymentIntentId The ID of the payment intent to confirm.
     * @return true if the payment was successfully confirmed, false otherwise.
     * @throws PaymentException If an error occurs while confirming the payment.
     */
    public boolean confirmPayment(String paymentIntentId) throws PaymentException {
        return sdk.confirmPayment(paymentIntentId); // Confirm the payment via the SDK.
    }
}