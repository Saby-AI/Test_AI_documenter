package model;
import java.util.ArrayList;
import java.util.List;
public class Party {
    private int nextId = 1;
    private int partyid;
    private String partynumber;
    private String partyname;
    private String partytype;
    private String partygroup;
    private String partystatus;
    private List<Address> addresses = new ArrayList<>();
    private List<Communication> communications = new ArrayList<>();
    Party(String name, String type, String group, String status) {
        partyid = nextId++;
        partynumber = genNumber(group);
        partyname = name;
        partytype = type;
        partygroup = group;
        partystatus = status;
    }
    private String genNumber(String group) {
        return group.substring(0, 2).toUpperCase() + "_" + System.currentTimeMillis();
    }
    public void addAddress(Address a) {
        addresses.add(a);
    }
    public void addCommunication(Communication c) {
        communications.add(c);
    }
    @Override
    public String toString() {
        StringBuilder sb = new StringBuilder();
        sb.append("Party {id:").append(partyid).append(", number:").append(partynumber).append(", name:").append(partyname).append(", type:").append(partytype).append(", group:").append(partygroup).append(", status:").append(partystatus).append(", addresses:").append(addresses).append(", communications:").append(communications).append("}");
        return sb.toString();
    }
}