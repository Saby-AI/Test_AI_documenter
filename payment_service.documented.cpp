/*
Date: 07/09/2025
User: Agentic_AI_System_Documenter
Code Language: C++
*/
#include <iostream>
#include <string>
#include <map>
#include <vector>
/**
 * @class PaymentService
 * @brief Class for handling payment processing and management of user payment methods.
 */
class PaymentService {
public:
    /**
     * @brief Processes a payment by deducting from the user's balance.
     *
     * @param userId The ID of the user for whom the payment is processed.
     * @param amount The amount to be deducted from the user's balance.
     */
    void processPayment(const std::string& userId, double amount);
    /**
     * @brief Refunds a payment by adding to the user's balance.
     *
     * @param userId The ID of the user for whom the refund is processed.
     * @param amount The amount to be added to the user's balance.
     */
    void refundPayment(const std::string& userId, double amount);
    /**
     * @brief Adds a payment method for the user.
     *
     * @param userId The ID of the user who is adding the payment method.
     * @param method The payment method to be added (e.g., "Credit Card").
     */
    void addPaymentMethod(const std::string& userId, const std::string& method);
    /**
     * @brief Gets the payment methods associated with the user.
     *
     * @param userId The ID of the user whose payment methods are retrieved.
     * @return A vector of payment methods associated with the user.
     */
    std::vector<std::string> getPaymentMethods(const std::string& userId);
private:
    // Mapping of user IDs to their payment methods
    std::map<std::string, std::vector<std::string>> userPaymentMethods;
    // Mapping of user IDs to their balances
    std::map<std::string, double> userBalances;
};
void PaymentService::processPayment(const std::string& userId, double amount) {
    // Deduct the payment amount from the user's balance
    userBalances[userId] -= amount;
    std::cout << "Processed payment of " << amount << " for user " << userId << std::endl;
}
void PaymentService::refundPayment(const std::string& userId, double amount) {
    // Add the refund amount to the user's balance
    userBalances[userId] += amount;
    std::cout << "Refunded payment of " << amount << " for user " << userId << std::endl;
}
void PaymentService::addPaymentMethod(const std::string& userId, const std::string& method) {
    // Add a payment method to the user's payment methods
    userPaymentMethods[userId].push_back(method);
}
std::vector<std::string> PaymentService::getPaymentMethods(const std::string& userId) {
    // Retrieve and return the payment methods for the user
    return userPaymentMethods[userId];
}
int main() {
    // Example usage of the PaymentService class
    PaymentService ps;
    ps.addPaymentMethod("user123", "Credit Card");
    ps.processPayment("user123", 50.0);
    ps.refundPayment("user123", 20.0);
    std::vector<std::string> methods = ps.getPaymentMethods("user123");
    // Displaying user's payment methods
    for (const std::string &method : methods) {
        std::cout << "Payment Method: " << method << std::endl;
    }
    return 0; // End of program
}