import java.util.Scanner;
public class Taking_user_input {
    public static void main(String[] args) {
        System.out.println("Taking input from the user: ");
        Scanner sc = new Scanner(System.in);
        System.out.println("Enter Number 1 : ");
        int a = sc.nextInt();
        System.out.println("Enter Number 2 : ");
        int b = sc.nextInt();
        System.out.print("Sum of Numbers : ");
        int sum = a + b ;
        System.out.println(sum);
    }
}
