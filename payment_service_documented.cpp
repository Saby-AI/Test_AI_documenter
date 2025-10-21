```java
/*
Date: 21/10/2025
User: Agentic_AI_System_Documenter
Code Language: Java
*/
import org.springframework.web.bind.annotation.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.http.HttpStatus;
import java.util.List;
/**
 * UserController handles user-related operations such as registration, authentication, and data retrieval.
 */
@RestController
@RequestMapping("/api/users")
public class UserController {
    private final UserService userService;
    /**
     * Constructor for UserController.
     *
     * @param userService the service used for user operations
     */
    @Autowired
    public UserController(UserService userService) {
        this.userService = userService;
    }
    /**
     * Registers a new user in the system.
     *
     * @param user the user object containing registration details
     * @return ResponseEntity indicating the result of the registration
     */
    @PostMapping("/register")
    public ResponseEntity<String> registerUser(@RequestBody User user) {
        userService.register(user);
        return new ResponseEntity<>("User registered successfully", HttpStatus.CREATED);
    }
    /**
     * Authenticates a user based on provided credentials.
     *
     * @param credentials the user's login credentials
     * @return ResponseEntity containing authentication result
     */
    @PostMapping("/login")
    public ResponseEntity<String> loginUser(@RequestBody Credentials credentials) {
        boolean isAuthenticated = userService.authenticate(credentials);
        if (isAuthenticated) {
            return new ResponseEntity<>("Login successful", HttpStatus.OK);
        } else {
            return new ResponseEntity<>("Invalid credentials", HttpStatus.UNAUTHORIZED);
        }
    }
    /**
     * Retrieves a list of all users in the system.
     *
     * @return ResponseEntity containing the list of users
     */
    @GetMapping
    public ResponseEntity<List<User>> getAllUsers() {
        List<User> users = userService.getAllUsers();
        return new ResponseEntity<>(users, HttpStatus.OK);
    }
}
```