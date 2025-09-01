```java
/*
Date: 01/09/2025
User: Agentic_AI_System_Documenter
Code Language: Java
*/

import com.example.paymentgateway.PaymentGatewaySDK;
import com.example.paymentgateway.models.PaymentIntent;
import com.example.paymentgateway.exceptions.PaymentException;

/**
 * PaymentService class handles payment processing functionalities including
 * creating payment intents and confirming payments using the PaymentGatewaySDK.
 */
public class PaymentService {

    private final PaymentGatewaySDK sdk;

    /**
     * Constructs a PaymentService instance with the provided secret key.
     *
     * @param secretKey the secret key used to initialize the PaymentGatewaySDK
     */
    public PaymentService(String secretKey) {
        this.sdk = new PaymentGatewaySDK(secretKey);
    }

    /**
     * Creates a payment intent with the specified amount and currency.
     *
     * @param amountInCents the amount to charge in cents
     * @param currency the currency for the payment (e.g., "USD")
     * @return the client secret associated with the created payment intent,
     *         which is useful for client-side processing
     * @throws PaymentException if there is an error while creating the payment intent
     */
    public String createPaymentIntent(long amountInCents, String currency) throws PaymentException {
        // Call to SDK to create a payment intent with specified amount and currency
        PaymentIntent intent = sdk.createPaymentIntent(amountInCents, currency);
        return intent.getClientSecret(); // Or a unique ID for client-side use
    }

    /**
     * Confirms a payment using the specified payment intent ID.
     *
     * @param paymentIntentId the ID of the payment intent to confirm
     * @return true if the payment was confirmed successfully, false otherwise
     * @throws PaymentException if there is an error while confirming the payment
     */
    public boolean confirmPayment(String paymentIntentId) throws PaymentException {
        // Call to SDK to confirm the payment using the payment intent ID
        return sdk.confirmPayment(paymentIntentId);
    }
}
```