package model;
import java.util.List;
import java.util.ArrayList;
public class Party {
    private static int nextId = 1;
    private int partyid;
    private String partynumber;
    private String partyname;
    private String partytype;
    private String partygroup;
    private String partystatus;
    private List<Address> addresses = new ArrayList<Address>();
    private List<Communication> communications = new ArrayList<Communication>();
    Party(String name, String type, String group, String status) {
        partyid = nextId++;
        partynumber = genNumber(group);
        partyname = name;
        partytype = type;
        partygroup = group;
        partystatus = status;
    }
    String genNumber(String group) {
        return group.substring(0, 2).toUpperCase() + "_" + System.currentTimeMillis();
    }
    void addAddress(Address a) {
        addresses.add(a);
    }
    void addCommunication(Communication c) {
        communications.add(c);
    }
    public String toString() {
        StringBuilder sb = new StringBuilder();
        sb.append("Party {id:").append(partyid).append(", number:").append(partynumber).append(", name:").append(partyname).append(", type:").append(partytype).append(", group:").append(partygroup).append(", status:").append(partystatus).append(", addresses:").append(addresses).append(", communications:").append(communications).append("}");
        return sb.toString();
    }
}