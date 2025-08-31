"""
Date: 31/08/2025
User: Agentic_AI_System_Documenter
Code Language: Python
"""

import payment_gateway_sdk

class PaymentService:
    """
    A service class to handle payment processing using an external payment gateway SDK.
    
    Attributes:
        sdk: An instance of the payment gateway SDK for performing payment-related operations.
    """

    def __init__(self, secret_key):
        """
        Initializes the PaymentService with a given secret key.
        
        Parameters:
            secret_key (str): The secret key used to authenticate with the payment gateway.
        """
        self.sdk = payment_gateway_sdk.SDK(secret_key)

    def create_payment_intent(self, amount_in_cents, currency):
        """
        Creates a payment intent for a specified amount and currency.

        Parameters:
            amount_in_cents (int): The amount to be charged, specified in cents.
            currency (str): The currency code (e.g., 'usd', 'eur') for the payment.

        Returns:
            str: The client secret or a unique identifier for client-side use.
        """
        # Call the SDK to create a payment intent
        intent = self.sdk.create_payment_intent(amount_in_cents, currency)
        return intent['client_secret']  # Return the client secret for client-side handling

    def confirm_payment(self, payment_intent_id):
        """
        Confirms a payment for a given payment intent ID.

        Parameters:
            payment_intent_id (str): The unique identifier for the payment intent to confirm.

        Returns:
            Response: The response from the payment gateway confirming the payment.
        """
        # Call the SDK to confirm the payment using the provided intent ID
        return self.sdk.confirm_payment(payment_intent_id)