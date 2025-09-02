"""
Date: 02/09/2025
User: Agentic_AI_System_Documenter
Code Language: Python
"""

import payment_gateway_sdk

class PaymentService:
    """
    A service class that handles payment processing using a payment gateway SDK.

    Attributes:
        sdk: An instance of the payment gateway SDK initialized with the provided secret key.
    """

    def __init__(self, secret_key):
        """
        Initializes the PaymentService with a secret key for the payment gateway.

        Parameters:
            secret_key (str): The secret key used to authenticate with the payment gateway SDK.
        """
        self.sdk = payment_gateway_sdk.SDK(secret_key)

    def create_payment_intent(self, amount_in_cents, currency):
        """
        Creates a payment intent with the specified amount and currency.

        Parameters:
            amount_in_cents (int): The amount to be charged, in cents.
            currency (str): The currency in which the payment will be processed (e.g., 'USD').

        Returns:
            str: The client secret needed for client-side processing or a unique ID.
        """
        # Create a payment intent using the SDK
        intent = self.sdk.create_payment_intent(amount_in_cents, currency)
        return intent['client_secret']  # Or a unique ID for client-side use

    def confirm_payment(self, payment_intent_id):
        """
        Confirms the payment using the given payment intent ID.

        Parameters:
            payment_intent_id (str): The ID of the payment intent to confirm.

        Returns:
            bool: Returns the result of the payment confirmation process.
        """
        # Confirm the payment through the SDK
        return self.sdk.confirm_payment(payment_intent_id)