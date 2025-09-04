/*
Date: 04/09/2025
User: Agentic_AI_System_Documenter
Code Language: Java
*/

/**
 * PaymentService class handles payment-related operations, including creating and confirming payments.
 * It encapsulates the SDK for the payment gateway, simplifying the integration for client usage.
 */
public class PaymentService {

    private final PaymentGatewaySDK sdk; // Instance variable to hold the PaymentGatewaySDK object

    /**
     * Constructs a PaymentService instance with the provided secret key.
     * 
     * @param secretKey the secret key to authenticate with the payment gateway
     */
    public PaymentService(String secretKey) {
        this.sdk = new PaymentGatewaySDK(secretKey);
    }

    /**
     * Creates a payment intent with the specified amount and currency.
     * 
     * @param amountInCents the amount to be charged, in cents
     * @param currency the currency code (e.g., "USD")
     * @return the client secret or unique ID for client-side use
     * @throws PaymentException if there is an error during the payment intent creation
     */
    public String createPaymentIntent(long amountInCents, String currency) throws PaymentException {
        // Invoke the SDK method to create a payment intent
        PaymentIntent intent = sdk.createPaymentIntent(amountInCents, currency);
        return intent.getClientSecret(); // Returns the client secret
    }

    /**
     * Confirms the payment corresponding to the provided payment intent ID.
     * 
     * @param paymentIntentId the ID of the payment intent to confirm
     * @return true if the payment is confirmed, false otherwise
     * @throws PaymentException if there is an error during payment confirmation
     */
    public boolean confirmPayment(String paymentIntentId) throws PaymentException {
        // Confirm the payment through the SDK
        return sdk.confirmPayment(paymentIntentId);
    }
}