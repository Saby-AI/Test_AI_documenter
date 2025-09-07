package model;
public class Communication {
    private String contactType;
    private String contact;
    public Communication(String type, String cont) {
        this.contactType = type;
        this.contact = cont;
        if (!valid(type, cont)) {
            throw new IllegalArgumentException("Bad contact: " + type);
        }
    }
    private boolean valid(String a, String b) {
        if (a.equalsIgnoreCase("email")) {
            return b.matches("[w.-]+@[w.-]+.w{2,}");
        } else if (a.equalsIgnoreCase("phone") || a.equalsIgnoreCase("fax")) {
            return b.matches("+?[0-9- ]{7,15}");
        } else {
            return false;
        }
    }
    @Override
    public String toString() {
        return "Comm{" + "type:" + contactType + ", contact:" + contact + "}";
    }
}