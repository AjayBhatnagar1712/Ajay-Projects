import java.util.Scanner;
public class Conditional_statement {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        System.out.print("Enter your age :");
        int a = sc.nextInt();
        if (a>18){
            System.out.println("You will get license");
        }
        else {
            System.out.println("You will not get license");
        }
    }
}