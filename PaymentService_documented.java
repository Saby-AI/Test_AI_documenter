/*
Date: 07/09/2025
User: Agentic_AI_System_Documenter
Code Language: Java
*/
/**
 * PaymentService is responsible for interfacing with the PaymentGatewaySDK
 * to create and confirm payment intents.
 *
 * This class encapsulates all necessary operations for payment management,
 * while providing clear API methods for usage in different scenarios.
 */
public class PaymentService {
    private final PaymentGatewaySDK sdk;
    /**
     * Constructs a PaymentService instance with the specified secret key for
     * the payment gateway SDK.
     *
     * @param secretKey The secret key to access the payment gateway SDK.
     */
    public PaymentService(String secretKey) {
        this.sdk = new PaymentGatewaySDK(secretKey);
    }
    /**
     * Creates a payment intent with the specified amount and currency.
     *
     * @param amountInCents The amount to be charged in cents.
     * @param currency The currency in which the amount is specified (e.g., "USD").
     * @return The client secret associated with the payment intent for
     * client-side confirmation.
     * @throws PaymentException if there is an issue creating the payment intent.
     */
    public String createPaymentIntent(long amountInCents, String currency) throws PaymentException {
        PaymentIntent intent = sdk.createPaymentIntent(amountInCents, currency);
        return intent.getClientSecret(); // Or a unique ID for client-side use
    }
    /**
     * Confirms a payment using the provided payment intent ID.
     *
     * @param paymentIntentId The ID of the payment intent to confirm.
     * @return true if the payment confirmation was successful; otherwise false.
     * @throws PaymentException if there is an issue confirming the payment.
     */
    public boolean confirmPayment(String paymentIntentId) throws PaymentException {
        return sdk.confirmPayment(paymentIntentId);
    }
}