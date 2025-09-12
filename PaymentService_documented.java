```java
/*
Date: 12/09/2025
User: Agentic_AI_System_Documenter
Code Language: Java
*/
/**
 * The PaymentService class handles payment operations using the PaymentGatewaySDK.
 * It includes methods to create and confirm payment intents.
 */
public class PaymentService {
    // Instance of PaymentGatewaySDK for processing payment operations.
    private final PaymentGatewaySDK sdk;
    /**
     * PaymentService constructor initializes the PaymentGatewaySDK with provided secret key.
     *
     * @param secretKey The secret key for authenticating with the payment gateway.
     */
    public PaymentService(String secretKey) {
        this.sdk = new PaymentGatewaySDK(secretKey); // Important: Ensure secret key is securely managed
    }
    /**
     * Creates a payment intent with the specified amount and currency.
     *
     * @param amountInCents The amount in cents to be charged.
     * @param currency The currency for the payment (e.g., "USD").
     * @return The client secret of the created payment intent.
     * @throws PaymentException if an error occurs while creating the payment intent.
     */
    public String createPaymentIntent(long amountInCents, String currency) throws PaymentException {
        PaymentIntent intent = sdk.createPaymentIntent(amountInCents, currency);
        return intent.getClientSecret(); // Return client secret for client-side use
    }
    /**
     * Confirms a previously created payment intent.
     *
     * @param paymentIntentId The id of the payment intent to confirm.
     * @return True if the payment is confirmed, otherwise false.
     * @throws PaymentException if an error occurs during payment confirmation.
     */
    public boolean confirmPayment(String paymentIntentId) throws PaymentException {
        return sdk.confirmPayment(paymentIntentId); // Confirm the payment through the SDK
    }
}
```
This comprehensive documentation ensures maintainability, understandability, and usability, adhering to coding standards while aligning with business and security expectations.