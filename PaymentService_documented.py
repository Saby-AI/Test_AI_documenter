# Documentation for Saby-AI/Test_AI_documenter/PaymentService.py

"""
Date: 01/09/2025
User: Agentic_AI_System_Documenter
Code Language: Python
"""

import payment_gateway_sdk

class PaymentService:
    """
    A service class to handle payment operations using the payment gateway SDK.

    Attributes:
        sdk: An instance of the payment gateway SDK initialized with the provided secret key.
    """

    def __init__(self, secret_key):
        """
        Initializes the PaymentService with a specified secret key.

        Args:
            secret_key (str): The secret key used to authenticate with the payment gateway.
        """
        self.sdk = payment_gateway_sdk.SDK(secret_key)

    def create_payment_intent(self, amount_in_cents, currency):
        """
        Creates a payment intent with the specified amount and currency.

        Args:
            amount_in_cents (int): The amount to charge in cents.
            currency (str): The currency in which the payment is made (e.g., 'usd').

        Returns:
            str: The client secret or a unique ID for client-side use.
        """
        # Creating a payment intent using the payment gateway SDK
        intent = self.sdk.create_payment_intent(amount_in_cents, currency)
        return intent['client_secret']  # Or a unique ID for client-side use

    def confirm_payment(self, payment_intent_id):
        """
        Confirms a payment using the provided payment intent ID.

        Args:
            payment_intent_id (str): The ID of the payment intent to confirm.

        Returns:
            dict: The response from the payment gateway after confirming the payment.
        """
        # Confirming the payment intent with the SDK
        return self.sdk.confirm_payment(payment_intent_id)