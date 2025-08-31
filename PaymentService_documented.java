```java
/*
Date: 31/08/2025
User: Agentic_AI_System_Documenter
Code Language: Java
*/

import com.example.paymentgateway.PaymentGatewaySDK;
import com.example.paymentgateway.models.PaymentIntent;
import com.example.paymentgateway.exceptions.PaymentException;

/**
 * Service class responsible for handling payment-related operations.
 */
public class PaymentService {

    private final PaymentGatewaySDK sdk;

    /**
     * Constructs a PaymentService with the specified secret key.
     *
     * @param secretKey The secret key used to initialize the payment gateway SDK.
     */
    public PaymentService(String secretKey) {
        this.sdk = new PaymentGatewaySDK(secretKey);
    }

    /**
     * Creates a payment intent with the specified amount and currency.
     *
     * @param amountInCents The amount of money to be charged in cents.
     * @param currency      The currency code (e.g., "USD", "EUR").
     * @return A client secret string for client-side use, or a unique ID.
     * @throws PaymentException If there is an error during the payment intent creation process.
     */
    public String createPaymentIntent(long amountInCents, String currency) throws PaymentException {
        // Create payment intent using the SDK
        PaymentIntent intent = sdk.createPaymentIntent(amountInCents, currency);
        return intent.getClientSecret(); // Or a unique ID for client-side use
    }

    /**
     * Confirms a payment using the specified payment intent ID.
     *
     * @param paymentIntentId The ID of the payment intent to confirm.
     * @return true if the payment was confirmed successfully, false otherwise.
     * @throws PaymentException If there is an error during the payment confirmation process.
     */
    public boolean confirmPayment(String paymentIntentId) throws PaymentException {
        // Confirm payment through the SDK
        return sdk.confirmPayment(paymentIntentId);
    }
}
```