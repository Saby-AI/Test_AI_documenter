/**
 * PaymentService is responsible for creating and confirming payment intents through
 * the PaymentGatewaySDK. It abstracts the complexities involved with payment transactions
 * and provides a simple interface for clients.
 */
public class PaymentService {
    private final PaymentGatewaySDK sdk; // Instance of the payment SDK
    /**
     * Constructor for initializing the PaymentService with the provided secret key.
     *
     * @param secretKey The secret key used to authenticate with the PaymentGatewaySDK
     */
    public PaymentService(String secretKey) {
        this.sdk = new PaymentGatewaySDK(secretKey); // Initialize the SDK
    }
    /**
     * Creates a payment intent for the specified amount and currency.
     *
     * @param amountInCents The amount to be charged, in cents.
     * @param currency The currency code, e.g., "USD".
     * @return The client secret or unique ID for the created payment intent.
     * @throws PaymentException if there is an error during payment intent creation.
     */
    public String createPaymentIntent(long amountInCents, String currency) throws PaymentException {
        PaymentIntent intent = sdk.createPaymentIntent(amountInCents, currency); // Create payment intent
        return intent.getClientSecret(); // Return client secret for client-side handling
    }
    /**
     * Confirms the payment for a given payment intent ID.
     *
     * @param paymentIntentId The unique identifier for the payment intent to be confirmed.
     * @return true if the payment was successfully confirmed, false otherwise.
     * @throws PaymentException if there is an error during payment confirmation.
     */
    public boolean confirmPayment(String paymentIntentId) throws PaymentException {
        return sdk.confirmPayment(paymentIntentId); // Confirm the payment intent
    }
}