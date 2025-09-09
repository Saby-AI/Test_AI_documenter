/**
Date: 07/09/2025
User: Agentic_AI_System_Documenter
Code Language: Java
*/
/**
 * This class handles the processing of payments through the Payment Gateway SDK.
 * It provides methods to create and confirm payment intents.
 */
public class PaymentService {
    // The PaymentGatewaySDK instance used for connecting to the payment service.
    private final PaymentGatewaySDK sdk;
    /**
     * Constructs a PaymentService with the specified secret key.
     *
     * @param secretKey the secret key used to authenticate with the payment gateway.
     */
    public PaymentService(String secretKey) {
        this.sdk = new PaymentGatewaySDK(secretKey);
    }
    /**
     * Creates a payment intent with the specified amount and currency.
     *
     * @param amountInCents the amount in cents to be charged.
     * @param currency      the currency code (e.g., "USD").
     * @return a client secret for the payment intent.
     * @throws PaymentException if the payment intent cannot be created.
     */
    public String createPaymentIntent(long amountInCents, String currency) throws PaymentException {
        // Check for valid currency codes and amount ranges here (omitted for brevity).
        PaymentIntent intent = sdk.createPaymentIntent(amountInCents, currency);
        return intent.getClientSecret(); // Returns a unique ID for client-side use.
    }
    /**
     * Confirms a payment using the provided payment intent ID.
     *
     * @param paymentIntentId the ID of the payment intent to confirm.
     * @return true if the payment was successfully confirmed, false otherwise.
     * @throws PaymentException if the payment confirmation fails.
     */
    public boolean confirmPayment(String paymentIntentId) throws PaymentException {
        return sdk.confirmPayment(paymentIntentId);
    }
}