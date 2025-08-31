
/*
Date: 31/08/2025
User: Agentic_AI_System_Documenter
Code Language: Java
*/

import com.example.paymentgateway.PaymentGatewaySDK;
import com.example.paymentgateway.models.PaymentIntent;
import com.example.paymentgateway.exceptions.PaymentException;

/**
 * PaymentService class handles the payment processing using the PaymentGatewaySDK.
 * It provides methods to create and confirm payment intents.
 */
public class PaymentService {

    private final PaymentGatewaySDK sdk; // Instance of PaymentGatewaySDK for payment operations

    /**
     * Constructs a PaymentService with the specified secret key.
     *
     * @param secretKey the secret key used to initialize the PaymentGatewaySDK
     */
    public PaymentService(String secretKey) {
        this.sdk = new PaymentGatewaySDK(secretKey); // Initialize the payment gateway SDK
    }

    /**
     * Creates a payment intent for a specified amount and currency.
     *
     * @param amountInCents the amount to charge, in cents
     * @param currency      the currency code (e.g., "USD")
     * @return the client secret or a unique ID for client-side usage
     * @throws PaymentException if there is an issue creating the payment intent
     */
    public String createPaymentIntent(long amountInCents, String currency) throws PaymentException {
        // Create a payment intent using the SDK
        PaymentIntent intent = sdk.createPaymentIntent(amountInCents, currency);
        return intent.getClientSecret(); // Return the client secret for further processing on the client side
    }

    /**
     * Confirms a payment using the specified payment intent ID.
     *
     * @param paymentIntentId the ID of the payment intent to confirm
     * @return true if the payment was confirmed successfully, false otherwise
     * @throws PaymentException if there is an issue confirming the payment
     */
    public boolean confirmPayment(String paymentIntentId) throws PaymentException {
        // Confirm the payment through the SDK
        return sdk.confirmPayment(paymentIntentId);
    }
}
