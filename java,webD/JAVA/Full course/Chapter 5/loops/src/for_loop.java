import java.util.Scanner;
public class for_loop {
    public static void main(String[] args) {
        //for loop in increasing order
        System.out.println("For Loop in inreasing order");
        int n = 5;
        for (int i = 0 ; i <= n ; i++){
            System.out.println(i);
        }

        //For decrementing loop
        System.out.println("For Decrementing loop");
        int m = 0;
        for (int j = 5 ; j >= m ; j--){
            System.out.println(j);
        }

        //Print first x natural numbers in reverse order
        //This is our question given by harry
        int x = 0;
        for( int z = 20 ; z>=x ; z--){
            System.out.println(z);
        }
    }
}
