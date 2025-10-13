/**
     * Constructs a new Address object with the specified parameters.
     *
     * @param type           The type of the address.
     * @param line1         The first line of the address.
     * @param line2         The second line of the address, optional. Can be null.
     * @param city          The city of the address.
     * @param state         The state of the address.
     * @param country       The country of the address.
     * @param postalCode    The postal code of the address.
     */
    public Address(String type, String line1, String line2, String city, String state, String country, String postalCode) {
        this.partyAddressId = addressCounter++;
        this.addressType = type;
        this.addressLine1 = line1;
        this.addressLine2 = line2;
        this.city = city;
        this.state = state;
        this.country = country;
        this.postalCode = postalCode;
    }
    /**
     * Returns a string representation of the Address object.
     *
     * @return A string in the form of "Address{ id:<id>, type:<type>, line1:<line1>, line2:<line2>,
     *         city:<city>, state:<state>, country:<country>, postal:<postalCode> }"
     */
    @Override
    public String toString() {
        return "Address{ id:" + partyAddressId + ", type:" + addressType + ", line1:" + addressLine1 +
               ", line2:" + addressLine2 + ", city:" + city + ", state:" + state +
               ", country:" + country + ", postal:" + postalCode + "}";
    }
}