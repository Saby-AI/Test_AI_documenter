/*
Date: 31/08/2025
User: Agentic_AI_System_Documenter
Code Language: Java
*/

import com.example.paymentgateway.PaymentGatewaySDK;
import com.example.paymentgateway.models.PaymentIntent;
import com.example.paymentgateway.exceptions.PaymentException;

/**
 * The PaymentService class handles the payment processing operations.
 * It utilizes the PaymentGatewaySDK to create and confirm payments.
 */
public class PaymentService {

    private final PaymentGatewaySDK sdk;

    /**
     * Constructs a PaymentService instance with the specified secret key.
     *
     * @param secretKey the secret key used for authenticating with the payment gateway.
     */
    public PaymentService(String secretKey) {
        this.sdk = new PaymentGatewaySDK(secretKey);
    }

    /**
     * Creates a payment intent with a specified amount and currency.
     *
     * @param amountInCents the amount to be charged in cents.
     * @param currency the currency in which the payment will be made.
     * @return the client secret for the payment intent, which can be used on the client side.
     * @throws PaymentException if there is an issue creating the payment intent.
     */
    public String createPaymentIntent(long amountInCents, String currency) throws PaymentException {
        // Create a new payment intent using the SDK
        PaymentIntent intent = sdk.createPaymentIntent(amountInCents, currency);
        // Return the client secret for the payment intent
        return intent.getClientSecret(); // Or a unique ID for client-side use
    }

    /**
     * Confirms a payment using the specified payment intent ID.
     *
     * @param paymentIntentId the ID of the payment intent to confirm.
     * @return true if the payment was successfully confirmed; false otherwise.
     * @throws PaymentException if there is an issue confirming the payment.
     */
    public boolean confirmPayment(String paymentIntentId) throws PaymentException {
        // Confirm the payment using the SDK
        return sdk.confirmPayment(paymentIntentId);
    }
}