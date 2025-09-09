/**
 * The PaymentService class is responsible for creating and confirming payment intents
 * using an external payment gateway SDK.
 */
public class PaymentService {
    /** Instance of the payment gateway SDK */
    private final PaymentGatewaySDK sdk;
    /**
     * Constructor initializes the PaymentService with a secret key.
     *
     * @param secretKey The secret key for authenticating with the payment gateway.
     */
    public PaymentService(String secretKey) {
        this.sdk = new PaymentGatewaySDK(secretKey);
    }
    /**
     * Creates a payment intent with the given amount and currency.
     *
     * @param amountInCents The amount in cents to be charged.
     * @param currency The currency code (e.g., "USD").
     * @return The client secret of the payment intent, used for client-side confirmation.
     * @throws PaymentException When there is an error creating the payment intent.
     */
    public String createPaymentIntent(long amountInCents, String currency) throws PaymentException {
        PaymentIntent intent = sdk.createPaymentIntent(amountInCents, currency);
        return intent.getClientSecret(); // Returns client secret for frontend use
    }
    /**
     * Confirms a payment using the provided payment intent ID.
     *
     * @param paymentIntentId The ID of the payment intent to confirm.
     * @return True if the payment was confirmed successfully, otherwise false.
     * @throws PaymentException When there is an error confirming the payment.
     */
    public boolean confirmPayment(String paymentIntentId) throws PaymentException {
        return sdk.confirmPayment(paymentIntentId);
    }
}