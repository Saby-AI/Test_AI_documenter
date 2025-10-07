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
 * PaymentService class is responsible for handling payment processing
 * operations using the PaymentGatewaySDK.
 */
public class PaymentService {
    private final PaymentGatewaySDK sdk;
    /**
     * Constructs a PaymentService instance with a specified secret key.
     *
     * @param secretKey the API secret key for authenticating with the payment gateway.
     *                  It is advised to load sensitive information from a secure source rather than hardcoding.
     */
    public PaymentService(String secretKey) {
        this.sdk = new PaymentGatewaySDK(secretKey);
    }
    /**
     * Creates a payment intent with specified amount and currency.
     *
     * @param amountInCents the total amount of the payment in cents.
     * @param currency the currency code (e.g., "USD").
     * @return the client secret associated with the payment intent for client-side use.
     * @throws PaymentException if there is an error creating the payment intent.
     */
    public String createPaymentIntent(long amountInCents, String currency) throws PaymentException {
        PaymentIntent intent = sdk.createPaymentIntent(amountInCents, currency);
        return intent.getClientSecret(); // Returns a unique identifier for client use.
    }
    /**
     * Confirms a payment using the payment intent ID.
     *
     * @param paymentIntentId the ID of the payment intent to confirm.
     * @return true if the payment was confirmed successfully, otherwise false.
     * @throws PaymentException if there is an error confirming the payment.
     */
    public boolean confirmPayment(String paymentIntentId) throws PaymentException {
        return sdk.confirmPayment(paymentIntentId);
    }
}
```
In the above documentation, we ensured encompassing comments describe the purpose, parameters, and outcome of each method, improving the maintainability and clarity for any developer interacting with the `PaymentService` class.