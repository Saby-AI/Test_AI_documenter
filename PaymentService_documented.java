```java
/*
Date: 07/10/2025
User: Agentic_AI_System_Documenter
Code Language: Java
*/
import com.example.paymentgateway.PaymentGatewaySDK;
import com.example.paymentgateway.models.PaymentIntent;
import com.example.paymentgateway.exceptions.PaymentException;
/**
 * Service for managing payment interactions with the payment gateway.
 * This class provides methods to create and confirm payment intents.
 */
public class PaymentService {
    private final PaymentGatewaySDK sdk;
    /**
     * Constructs a PaymentService with the specified secret key.
     * This key is essential for initializing the SDK instance.
     *
     * @param secretKey The secret key for the payment gateway SDK.
     */
    public PaymentService(String secretKey) {
        // Initialize the payment gateway SDK with the given secret key
        this.sdk = new PaymentGatewaySDK(secretKey);
    }
    /**
     * Creates a payment intent with the specified amount and currency.
     * This method interacts with the payment SDK to create a new payment intent.
     *
     * @param amountInCents The amount to charge in cents.
     * @param currency The currency in which the amount is specified (e.g., "USD").
     * @return The client secret for the payment intent, required on the client side.
     * @throws PaymentException if there is an error creating the payment intent.
     */
    public String createPaymentIntent(long amountInCents, String currency) throws PaymentException {
        // Create a new payment intent using the SDK and return the client secret
        PaymentIntent intent = sdk.createPaymentIntent(amountInCents, currency);
        return intent.getClientSecret(); // Or a unique ID for client-side use
    }
    /**
     * Confirms the payment based on the provided payment intent ID.
     * This method checks with the SDK whether the payment has been successfully confirmed.
     *
     * @param paymentIntentId The ID of the payment intent to confirm.
     * @return true if the payment was successfully confirmed, false otherwise.
     * @throws PaymentException if there is an error confirming the payment.
     */
    public boolean confirmPayment(String paymentIntentId) throws PaymentException {
        // Confirm the payment through the SDK using the given payment intent ID
        return sdk.confirmPayment(paymentIntentId);
    }
}
```