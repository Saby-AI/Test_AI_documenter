/**
     * Formats details of the party into a string representation.
     *
     * @return formatted string containing party details
     */
    public String formatDetails() {
        return "Party Name: " + name + ", Number of Guests: " + guests;
    }
    /**
     * Prints the details of the party to the console in a readable format.
     */
    public void printDetails() {
        StringBuilder sb = new StringBuilder();
        sb.append("Party Name: ").append(name).append(", Number of Guests: ").append(guests);
        System.out.println(sb.toString());
    }
}