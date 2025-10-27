/*
Date: 27/10/2025
User: Agentic_AI_System_Documenter
Code Language: Java
*/
/**
 * Represents an Address entity with fields for street, city, state, and postal code.
 * This class provides methods to get and set address components, ensuring encapsulation.
 * Future enhancements should include input validation and immutability for better security and integrity.
 */
public class Address {
    private String street;
    private String city;
    private String state;
    private String postalCode;
    /**
     * Gets the street of the address.
     * @return The street as a String.
     */
    public String getStreet() {
        return street;
    }
    /**
     * Sets the street of the address.
     * @param street The street to set. Should not be null or empty.
     * @throws IllegalArgumentException if street is null or empty.
     */
    public void setStreet(String street) {
        if (street == null || street.isEmpty()) {
            throw new IllegalArgumentException("Street cannot be null or empty");
        }
        this.street = street;
    }
    /**
     * Gets the city of the address.
     * @return The city as a String.
     */
    public String getCity() {
        return city;
    }
    /**
     * Sets the city of the address.
     * @param city The city to set. Should not be null or empty.
     * @throws IllegalArgumentException if city is null or empty.
     */
    public void setCity(String city) {
        if (city == null || city.isEmpty()) {
            throw new IllegalArgumentException("City cannot be null or empty");
        }
        this.city = city;
    }
    /**
     * Gets the state of the address.
     * @return The state as a String.
     */
    public String getState() {
        return state;
    }
    /**
     * Sets the state of the address.
     * @param state The state to set. Should not be null or empty.
     * @throws IllegalArgumentException if state is null or empty.
     */
    public void setState(String state) {
        if (state == null || state.isEmpty()) {
            throw new IllegalArgumentException("State cannot be null or empty");
        }
        this.state = state;
    }
    /**
     * Gets the postal code of the address.
     * @return The postal code as a String.
     */
    public String getPostalCode() {
        return postalCode;
    }
    /**
     * Sets the postal code of the address.
     * @param postalCode The postal code to set. Should not be null or empty.
     * @throws IllegalArgumentException if postalCode is null or empty.
     */
    public void setPostalCode(String postalCode) {
        if (postalCode == null || postalCode.isEmpty()) {
            throw new IllegalArgumentException("Postal code cannot be null or empty");
        }
        this.postalCode = postalCode;
    }
}