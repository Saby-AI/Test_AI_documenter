/*
Date: 02/09/2025
User: Agentic_AI_System_Documenter
Code Language: Java
*/

import com.example.paymentgateway.PaymentGatewaySDK;
import com.example.paymentgateway.models.PaymentIntent;
import com.example.paymentgateway.exceptions.PaymentException;

/**
 * PaymentService is responsible for handling payment-related operations
 * such as creating and confirming payment intents using the PaymentGatewaySDK.
 */
public class PaymentService {

    private final PaymentGatewaySDK sdk;

    /**
     * Constructs a PaymentService with the given secret key.
     * 
     * @param secretKey the secret key used for authenticating with the payment gateway
     */
    public PaymentService(String secretKey) {
        this.sdk = new PaymentGatewaySDK(secretKey);
    }

    /**
     * Creates a payment intent with the specified amount and currency.
     *
     * @param amountInCents the total amount in cents for the payment
     * @param currency the currency in which the payment is made (e.g., "USD")
     * @return the client secret of the payment intent for client-side use
     * @throws PaymentException if an error occurs while creating the payment intent
     */
    public String createPaymentIntent(long amountInCents, String currency) throws PaymentException {
        // Creating a new payment intent via the SDK
        PaymentIntent intent = sdk.createPaymentIntent(amountInCents, currency);
        // Returning the client secret for the payment intent
        return intent.getClientSecret(); // Or a unique ID for client-side use
    }

    /**
     * Confirms a payment using the specified payment intent ID.
     *
     * @param paymentIntentId the ID of the payment intent to confirm
     * @return true if the payment was successfully confirmed, false otherwise
     * @throws PaymentException if an error occurs while confirming the payment
     */
    public boolean confirmPayment(String paymentIntentId) throws PaymentException {
        // Confirming the payment using the SDK
        return sdk.confirmPayment(paymentIntentId);
    }
}