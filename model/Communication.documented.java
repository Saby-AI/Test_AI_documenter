package model;
public class Communication {
    private String contactType;
    private String contact;
    public Communication(String type, String cont) {
        this.contactType = type;
        this.contact = cont;
        if (!isValid(type, cont)) {
            throw new IllegalArgumentException("Bad contact: " + type);
        }
    }
    private boolean isValid(String type, String contact) {
        switch (type.toLowerCase()) {
            case "email":
                return contact.matches("[w.-]+@[w.-]+.w{2,}");
            case "phone":
            case "fax":
                return contact.matches("+?[0-9- ]{7,15}");
            default:
                return false;
        }
    }
    @Override
    public String toString() {
        return "Comm{" + "type: " + contactType + ", contact: " + contact + "}";
    }
}