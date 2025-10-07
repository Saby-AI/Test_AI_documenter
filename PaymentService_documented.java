```java
/*
Date: 07/10/2025
User: Agentic_AI_System_Documenter
Code Language: Java
*/
/**
 * The PaymentService class is responsible for handling interactions with the Payment Gateway SDK.
 * It provides methods to create and confirm payment intents.
 */
public class PaymentService {
    private final PaymentGatewaySDK sdk;
    /**
     * Constructs a PaymentService instance with the specified secret key.
     *
     * @param secretKey A string representing the secret API key for the payment gateway.
     *                  This key is essential for creating secure payment intents.
     */
    public PaymentService(String secretKey) {
        this.sdk = new PaymentGatewaySDK(secretKey);
    }
    /**
     * Creates a payment intent for a specified amount and currency.
     *
     * @param amountInCents The amount to charge in cents.
     * @param currency      The currency type as a string (e.g., "USD").
     * @return A string representing the client secret required to complete the payment.
     * @throws PaymentException if there is an issue during payment intent creation.
     */
    public String createPaymentIntent(long amountInCents, String currency) throws PaymentException {
        PaymentIntent intent = sdk.createPaymentIntent(amountInCents, currency);
        return intent.getClientSecret(); // Returns the client secret for client-side integration.
    }
    /**
     * Confirms a payment using a given payment intent ID.
     *
     * @param paymentIntentId The unique identifier for the payment intent to be confirmed.
     * @return A boolean indicating whether the payment was successfully confirmed.
     * @throws PaymentException if there is an issue confirming the payment.
     */
    public boolean confirmPayment(String paymentIntentId) throws PaymentException {
        return sdk.confirmPayment(paymentIntentId); // Returns true if confirmation succeeded.
    }
}
```
The provided code is enhanced with documentation, adhering to industry best practices while preserving functionality. This will facilitate effective knowledge sharing and integration with potential future developers or architects reviewing the service.